import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { Title } from '@/components/common/Title'
import { CoreConfigCard } from '@/pages/SettingsPage/components/CoreConfigCard'
import { GeneralAboutCard } from '@/pages/SettingsPage/components/GeneralAboutCard'
import { OtherSetting } from '@/pages/SettingsPage/components/OtherSetting'

export default function Settings() {
  const location = useLocation()

  useEffect(() => {
    const hash = location.hash
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [location.hash])

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 py-6">
          <div className="shrink-0">
            <Title title="设置" description="管理应用程序设置和偏好" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 min-w-0">
            <CoreConfigCard />
            <GeneralAboutCard />
            <OtherSetting />
          </div>
        </div>
      </div>
    </div>
  )
}
