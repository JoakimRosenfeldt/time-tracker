import type { TimeTrackerApi } from './index'

declare global {
  interface Window {
    api: TimeTrackerApi
  }
}

export {}
