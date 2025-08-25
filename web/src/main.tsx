import React, { useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntApp, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter } from 'react-router-dom'
import App from './pages/App'
import 'antd/dist/reset.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {(() => {
      const Root = () => {
        const [isDark, setIsDark] = useState(() => (localStorage.getItem('theme') === 'dark'))
        const algorithm = useMemo(() => (isDark ? theme.darkAlgorithm : theme.defaultAlgorithm), [isDark])
        const tokens = useMemo(() => ({
          colorPrimary: '#177ddc',
          borderRadius: 8,
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'`,
        }), [])
        const toggleTheme = () => {
          const next = !isDark; setIsDark(next); localStorage.setItem('theme', next ? 'dark' : 'light')
        }
        React.useEffect(() => {
          const el = document.documentElement
          el.classList.toggle('theme-dark', isDark)
          el.classList.toggle('theme-light', !isDark)
          el.setAttribute('data-theme', isDark ? 'dark' : 'light')
        }, [isDark])
        return (
          <ConfigProvider locale={zhCN} theme={{ algorithm, token: tokens }}>
            <AntApp>
              <BrowserRouter>
                <App isDark={isDark} onToggleTheme={toggleTheme} />
              </BrowserRouter>
            </AntApp>
          </ConfigProvider>
        )
      }
      return <Root />
    })()}
  </React.StrictMode>
)
