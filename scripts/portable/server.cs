using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

/// <summary>
/// 极速简历 Windows 免安装版静态服务器。
///
/// 只依赖 Windows 自带的 .NET Framework，不需要安装 Node.js。
/// 监听 127.0.0.1，仅本机可访问；启动后自动打开默认浏览器。
/// </summary>
internal static class Program
{
    private static readonly Dictionary<string, string> ContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".js", "text/javascript; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".svg", "image/svg+xml" },
            { ".ico", "image/x-icon" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".ttf", "font/ttf" },
            { ".txt", "text/plain; charset=utf-8" }
        };

    private static string _root;
    private static bool _noBrowser;

    private static int Main(string[] args)
    {
        try { Console.OutputEncoding = new UTF8Encoding(false); }
        catch { }
        try { Console.Title = "极速简历"; }
        catch { }

        _root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist");
        string indexPath = Path.Combine(_root, "index.html");
        if (!File.Exists(indexPath))
        {
            Console.WriteLine("找不到 dist\\index.html。");
            Console.WriteLine("请重新解压完整的压缩包，不要只复制单个 exe 文件。");
            Pause();
            return 1;
        }

        _noBrowser = string.Equals(Environment.GetEnvironmentVariable("NO_BROWSER"), "1", StringComparison.Ordinal)
            || Array.IndexOf(args, "--no-browser") >= 0;

        TcpListener listener = null;
        int port = 0;
        for (int candidate = 10087; candidate <= 10107; candidate++)
        {
            try
            {
                TcpListener probe = new TcpListener(IPAddress.Loopback, candidate);
                probe.Start();
                listener = probe;
                port = candidate;
                break;
            }
            catch (SocketException)
            {
                // 端口被占用，继续尝试下一个
            }
        }

        if (listener == null)
        {
            Console.WriteLine("端口 10087-10107 都被占用，无法启动。");
            Console.WriteLine("请关闭占用这些端口的程序后重试。");
            Pause();
            return 1;
        }

        string url = "http://127.0.0.1:" + port + "/";
        Console.WriteLine("极速简历 v1.0.0 已启动");
        Console.WriteLine("访问地址：" + url);
        Console.WriteLine("使用期间请不要关闭此窗口；关闭窗口即可停止。");
        Console.WriteLine();

        if (!_noBrowser)
        {
            try
            {
                Process.Start(url);
            }
            catch (Exception error)
            {
                Console.WriteLine("浏览器未能自动打开，请手动访问上面的地址。");
                Console.WriteLine(error.Message);
            }
        }

        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(HandleClient, client);
        }
    }

    private static void HandleClient(object state)
    {
        TcpClient client = state as TcpClient;
        if (client == null) return;

        using (client)
        {
            try
            {
                client.ReceiveTimeout = 10000;
                client.SendTimeout = 10000;

                NetworkStream stream = client.GetStream();
                string headers = ReadHeaders(stream);
                if (headers == null) return;

                string requestLine = headers.Split('\n')[0].Trim();
                string[] parts = requestLine.Split(' ');
                if (parts.Length < 2) return;

                string method = parts[0].ToUpperInvariant();
                if (method != "GET" && method != "HEAD")
                {
                    WriteResponse(stream, "405 Method Not Allowed", "text/plain; charset=utf-8",
                        Encoding.UTF8.GetBytes("Method Not Allowed"), false);
                    return;
                }

                string target = parts[1];
                int queryIndex = target.IndexOf('?');
                if (queryIndex >= 0) target = target.Substring(0, queryIndex);
                int fragmentIndex = target.IndexOf('#');
                if (fragmentIndex >= 0) target = target.Substring(0, fragmentIndex);
                if (target.Length == 0) target = "/";

                string decoded;
                try { decoded = Uri.UnescapeDataString(target); }
                catch { decoded = target; }

                if (decoded == "/") decoded = "/index.html";

                string relative = decoded.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                string fullPath = Path.GetFullPath(Path.Combine(_root, relative));
                string rootPrefix = Path.GetFullPath(_root) + Path.DirectorySeparatorChar;
                if (!fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, "403 Forbidden", "text/plain; charset=utf-8",
                        Encoding.UTF8.GetBytes("Forbidden"), false);
                    return;
                }

                if (Directory.Exists(fullPath))
                {
                    fullPath = Path.Combine(fullPath, "index.html");
                }

                if (!File.Exists(fullPath) && Path.GetExtension(fullPath).Length == 0)
                {
                    fullPath = Path.Combine(_root, "index.html");
                }

                if (!File.Exists(fullPath))
                {
                    WriteResponse(stream, "404 Not Found", "text/plain; charset=utf-8",
                        Encoding.UTF8.GetBytes("Not Found"), false);
                    return;
                }

                byte[] body = File.ReadAllBytes(fullPath);
                string contentType;
                if (!ContentTypes.TryGetValue(Path.GetExtension(fullPath), out contentType))
                {
                    contentType = "application/octet-stream";
                }

                WriteResponse(stream, "200 OK", contentType, body, method == "HEAD");
            }
            catch (Exception)
            {
                // 单个请求异常不影响后续请求
            }
        }
    }

    private static string ReadHeaders(NetworkStream stream)
    {
        MemoryStream buffer = new MemoryStream();
        byte[] chunk = new byte[2048];
        int total = 0;

        while (total < 16384)
        {
            int read = stream.Read(chunk, 0, chunk.Length);
            if (read <= 0) break;
            buffer.Write(chunk, 0, read);
            total += read;

            string text = Encoding.ASCII.GetString(buffer.ToArray());
            if (text.Contains("\r\n\r\n") || text.Contains("\n\n")) return text;
        }

        return total > 0 ? Encoding.ASCII.GetString(buffer.ToArray()) : null;
    }

    private static void WriteResponse(NetworkStream stream, string status, string contentType, byte[] body, bool headOnly)
    {
        string header = "HTTP/1.1 " + status + "\r\n"
            + "Content-Type: " + contentType + "\r\n"
            + "Content-Length: " + body.Length + "\r\n"
            + "Cache-Control: no-store\r\n"
            + "X-Content-Type-Options: nosniff\r\n"
            + "Connection: close\r\n\r\n";

        byte[] headerBytes = Encoding.ASCII.GetBytes(header);
        stream.Write(headerBytes, 0, headerBytes.Length);
        if (!headOnly) stream.Write(body, 0, body.Length);
    }

    private static void Pause()
    {
        Console.WriteLine("按任意键退出...");
        try { Console.ReadKey(true); }
        catch { }
    }
}
