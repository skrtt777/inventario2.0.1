import { useState } from 'react'

interface Props {
  onSearch: (term: string) => void
}
export default function SearchBar({ onSearch }: Props) {
  const [q, setQ] = useState('')
  return (
    <div className="flex gap-2 items-center">
  
    </div>
  )
}