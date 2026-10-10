import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { Empty, Skeleton } from './components/ui'
import Feed from './pages/Feed'
import { useRipples } from './components/motion'
import { useT } from './i18n'

const Report = lazy(() => import('./pages/Report'))
const IssueDetail = lazy(() => import('./pages/IssueDetail'))
const MapPage = lazy(() => import('./pages/MapPage'))
const Stories = lazy(() => import('./pages/Stories'))
const StoryDetail = lazy(() => import('./pages/Stories').then((m) => ({ default: m.StoryDetail })))
const Profile = lazy(() => import('./pages/Profile'))
const Admin = lazy(() => import('./pages/Admin'))
const Contractor = lazy(() => import('./pages/Contractor'))
const SignIn = lazy(() => import('./pages/SignIn'))

function App() {
  const t = useT()
  useRipples()
  return (
    <BrowserRouter>
      <Suspense fallback={<Skeleton h={480} />}>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route element={<AppShell />}>
            <Route index element={<Feed />} />
            <Route path="report" element={<Report />} />
            <Route path="issue/:id" element={<IssueDetail />} />
            <Route path="map" element={<MapPage />} />
            <Route path="stories" element={<Stories />} />
            <Route path="stories/:id" element={<StoryDetail />} />
            <Route path="me" element={<Profile />} />
            <Route path="admin" element={<Admin />} />
            <Route path="contractor" element={<Contractor />} />
            <Route path="*" element={<Empty title={t('This page fell through a pothole')} icon="alert" />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
