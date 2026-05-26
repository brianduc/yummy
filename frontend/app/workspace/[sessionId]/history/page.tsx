'use client'

import RagPanel from '@/components/workspace/RagPanel'
import { useChat } from '@/hooks/useWorkspaceChat'

export default function HistoryPage() {
  const { chatHistory } = useChat()

  return (
    <div data-testid="history-page" className="h-full">
      <RagPanel chatHistory={chatHistory || []} />
    </div>
  )
}
