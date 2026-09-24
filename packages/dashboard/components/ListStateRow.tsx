import { TableCell, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { ListView } from '@/lib/list-view'

interface Props {
  view: ListView
  colSpan: number
  /** What the table lists, for the failure line: "Couldn't load tokens." */
  noun: string
  emptyText: string
  onRetry: () => void
  retrying: boolean
}

/**
 * The single row a table shows instead of its rows. A failure is its own sentence with a way to try
 * again, not the empty text — "the relay did not answer" and "you have none" are different facts.
 *
 * `aria-disabled` rather than `disabled` while retrying: a focused button that becomes disabled drops
 * focus to `body` (see this package's AGENTS.md).
 */
export function ListStateRow({ view, colSpan, noun, emptyText, onRetry, retrying }: Props) {
  if (view === 'list') return null
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-20 text-center text-muted-foreground">
        {view === 'loading' ? 'Loading…' : view === 'empty' ? emptyText : `Couldn't load ${noun}.`}
        {view === 'error' && (
          <Button
            variant="outline"
            size="sm"
            className="ml-3 aria-disabled:opacity-50"
            aria-disabled={retrying}
            onClick={() => { if (!retrying) onRetry() }}
          >
            {retrying ? 'Trying…' : 'Try again'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
