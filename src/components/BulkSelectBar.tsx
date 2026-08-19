import { Button } from "@/components/ui/button";
import { Trash2, X, CheckSquare } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  selecting: boolean;
  onStart: () => void;
  onExit: () => void;
  count: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  noun?: string;
};

export default function BulkSelectBar({
  selecting, onStart, onExit, count, allSelected, onSelectAll, onDelete, noun = "item",
}: Props) {
  if (!selecting) {
    return (
      <Button size="sm" variant="outline" onClick={onStart}>
        <CheckSquare className="h-4 w-4 mr-1" /> Select
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" variant="outline" onClick={onSelectAll}>
        {allSelected ? "Clear all" : "Select all"}
      </Button>
      <span className="text-sm text-muted-foreground">{count} selected</span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={count === 0}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} {noun}{count === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This action can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button size="sm" variant="ghost" onClick={onExit}><X className="h-4 w-4" /></Button>
    </div>
  );
}
