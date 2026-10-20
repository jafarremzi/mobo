const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const MicIcon = () => (
  <svg {...base}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
)
export const StopIcon = () => (
  <svg {...base}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
)
export const BellIcon = () => (
  <svg {...base}><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" /></svg>
)
export const PlusIcon = () => (
  <svg {...base}><path d="M12 5v14M5 12h14" /></svg>
)
export const CheckIcon = () => (
  <svg {...base} strokeWidth={3}><path d="m5 12 5 5 9-10" /></svg>
)
export const TrashIcon = () => (
  <svg {...base}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
export const CloseIcon = () => (
  <svg {...base} width={14} height={14}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const FolderIcon = () => (
  <svg {...base}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
)
