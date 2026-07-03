// OS redesign: templates re-mount on every route change, so each page lands
// with the panel entrance (fade + lift + unblur) — navigation feels like
// switching layers in one running system, not loading a new page.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="panel-enter min-h-full">{children}</div>
}
