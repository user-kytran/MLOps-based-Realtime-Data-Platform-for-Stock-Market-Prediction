"use client"

import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import { useRouter } from "next/navigation"

interface StockHeaderProps {
  symbol: string
  name: string
}

export function StockHeader({ symbol, name }: StockHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-lg"
        >
          <Icons.ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 text-gray-900">
            {symbol} 
            <span className="text-2xl font-normal text-gray-600">({name})</span>
          </h1>
        </div>
      </div>
    </div>
  )
}

