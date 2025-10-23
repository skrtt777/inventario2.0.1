import type { Status } from '../types/item'
import clsx from 'clsx'

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold',
      status === 'ATIVA' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
    )}>
      {status}
    </span>
  )
}