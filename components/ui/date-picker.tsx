"use client"

import * as React from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string // YYYY-MM format
  onChange?: (value: string) => void
  placeholder?: string
}

export function DatePicker({ value, onChange, placeholder = "日付を選択" }: DatePickerProps) {
  // Convert YYYY-MM string to Date object
  const dateValue = value ? new Date(value + "-01") : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date && onChange) {
      // Convert Date to YYYY-MM format
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      onChange(`${year}-${month}`)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(dateValue!, "yyyy年MM月", { locale: ja }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-lg z-50">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
          locale={ja}
          className="rounded-md bg-white"
        />
      </PopoverContent>
    </Popover>
  )
}