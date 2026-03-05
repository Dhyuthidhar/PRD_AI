import ConversationInterface from '@/components/ConversationInterface'

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConversationInterface conversationId={id} />
}
