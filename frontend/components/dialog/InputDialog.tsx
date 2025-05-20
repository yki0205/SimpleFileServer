import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"

interface InputDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  title: string
  description: string
  confirmText: string
  cancelText: string
  defaultValue?: string
  placeholder?: string
  onConfirm: (value: string) => void
  onCancel: () => void
  className?: string
}

export function InputDialog({ 
  open, 
  setOpen, 
  title, 
  description, 
  confirmText, 
  cancelText, 
  defaultValue = "", 
  placeholder = "",
  onConfirm, 
  onCancel, 
  className 
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  
  // Reset value when dialog opens with new defaultValue
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);
  
  const handleConfirm = () => {
    onConfirm(value);
    setOpen(false);
  };
  
  const handleCancel = () => {
    onCancel();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={cn(
        "bg-black/80 border-white/10",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-bottom-1/2 data-[state=open]:slide-in-from-bottom-1/2",
        className
      )}>
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-white/60">{description}</DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="bg-black/40 border-white/20 text-white"
            autoFocus
          />
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="text-white/60 hover:text-red-500 bg-transparent border-white/20"
          >
            {cancelText}
          </Button>
          <Button 
            variant="outline"
            onClick={handleConfirm}
            className="text-white hover:text-white/80 bg-transparent border-white/20"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
