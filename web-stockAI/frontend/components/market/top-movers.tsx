"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, Flame } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useTopMoversWS } from "@/hooks/useTopMoversWS"



export function TopMovers() {
  const { gainers, losers } = useTopMoversWS()

  return (
    <Card className="bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-sky-400" />
          Top Movers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gainers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 rounded-md">
            <TabsTrigger value="gainers" className="text-white data-[state=active]:text-black data-[state=active]:bg-sky-700 text-sm flex items-center justify-center">
              <TrendingUp className="h-4 w-4 mr-1 text-green-400" />
              Gainers
            </TabsTrigger>
            <TabsTrigger value="losers" className="text-white data-[state=active]:text-black data-[state=active]:bg-sky-700 text-sm flex items-center justify-center">
              <TrendingDown className="h-4 w-4 mr-1 text-red-400" />
              Losers
            </TabsTrigger>
          </TabsList>

          {/* Gainers */}
          <TabsContent value="gainers" className="mt-4">
            <div className="space-y-3">
              {gainers.map((stock, index) => (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">
                        <Link href={`/stock/${stock.symbol}`}>{stock.symbol}</Link>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        VL: {(Number(stock.day_volume) || 0).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500 hover:bg-green-600 text-white font-mono text-xs flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      +{stock.change_percent}%
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {(Number(stock.price) || 0).toLocaleString("vi-VN")} đ
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Losers */}
          <TabsContent value="losers" className="mt-4">
            <div className="space-y-3">
              {losers.map((stock, index) => (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-mono">
                        <Link href={`/stock/${stock.symbol}`}>{stock.symbol}</Link>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        VL: {(Number(stock.day_volume) || 0).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-red-500 hover:bg-red-600 text-white font-mono text-xs flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {stock.change_percent}%
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {(Number(stock.price) || 0).toLocaleString("vi-VN")} đ
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
