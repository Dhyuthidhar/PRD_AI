const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ixhylgavddergodsmwhp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aHlsZ2F2ZGRlcmdvZHNtd2hwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAzMTQyOSwiZXhwIjoyMDg3NjA3NDI5fQ.gyWCdIWGH5XNbOoV0vDOrRSwhH4NaR0q-QATOBf26Tc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanupDuplicates() {
  try {
    console.log('Cleaning up duplicate conversations...')
    
    // Get all conversations with empty messages and in_progress status
    const { data: duplicates, error: fetchError } = await supabase
      .from('conversations')
      .select('id, project_name, created_at, messages')
      .eq('status', 'in_progress')
    
    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return
    }
    
    // Filter conversations with empty messages
    const emptyConversations = duplicates.filter(conv => 
      !conv.messages || conv.messages.length === 0
    )
    
    console.log(`Found ${emptyConversations.length} duplicate conversations`)
    
    if (emptyConversations.length > 0) {
      // Keep only the most recent one, delete the rest
      const sortedDuplicates = emptyConversations.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      // Keep the first (most recent) one
      const toKeep = sortedDuplicates[0]
      const toDelete = sortedDuplicates.slice(1)
      
      console.log(`Keeping: ${toKeep.project_name} (${toKeep.id})`)
      console.log(`Deleting ${toDelete.length} duplicates...`)
      
      if (toDelete.length > 0) {
        const idsToDelete = toDelete.map(conv => conv.id)
        const { error: deleteError } = await supabase
          .from('conversations')
          .delete()
          .in('id', idsToDelete)
        
        if (deleteError) {
          console.error('Delete error:', deleteError)
        } else {
          console.log(`Successfully deleted ${toDelete.length} duplicate conversations`)
        }
      }
    }
    
    console.log('Cleanup completed!')
    
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

cleanupDuplicates()
