import Taro from '@tarojs/taro'
import { PropsWithChildren, useEffect } from 'react'

import '@taroify/core/styles/index.css'
import { showRealDevicePreviewNotice } from './platform/realDevicePreview'
import './app.less'

interface TaroNotSupportEvent {
  type: 'component' | 'method'
}

function App({ children }: PropsWithChildren<any>) {
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return

    const handleNotSupport = (event: TaroNotSupportEvent) => {
      if (event.type !== 'method') return
      void showRealDevicePreviewNotice()
    }

    Taro.eventCenter.on('__taroNotSupport', handleNotSupport)
    return () => {
      Taro.eventCenter.off('__taroNotSupport', handleNotSupport)
    }
  }, [])

  return children
}

export default App
