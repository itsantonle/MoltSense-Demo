'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="bg-slate-900 border border-cyan-500/30 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-100">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-slate-400">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 rounded bg-red-500/20 text-red-200 border border-red-500/40"
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
