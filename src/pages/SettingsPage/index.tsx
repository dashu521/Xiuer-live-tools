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
    <div className="w-full py-6 flex flex-col gap-6 min-h-0 overflow-auto">
      <div className="shrink-0">
        <Title title="设置" description="管理应用程序设置和偏好" />
      </div>

      <div className="flex flex-col gap-6 min-w-0 flex-1 min-h-0">
        <CoreConfigCard />
        <GeneralAboutCard />
        <OtherSetting />
      </div>
    </div>
  )
}
