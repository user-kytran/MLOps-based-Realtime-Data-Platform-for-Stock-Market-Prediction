import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MatchedOrder } from "@/types/stock"

interface MatchedOrdersSidebarProps {
  matchedOrders: MatchedOrder[]
}

export function MatchedOrdersSidebar({ matchedOrders }: MatchedOrdersSidebarProps) {
  return (
    <Card className="h-full bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-center text-gray-900">Matched Orders</CardTitle>
        <p className="text-xs text-center text-gray-500">
          Update realtime
        </p>
      </CardHeader>
      <CardContent className="p-2">
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-center border-b border-gray-200 pb-2 px-2">
            <div className="text-gray-600">Time</div>
            <div className="text-gray-600">Price</div>
            <div className="text-gray-600">Last Size</div>
            <div className="text-gray-600">Change</div>
          </div>
          
          {/* Matched Orders List */}
          <div className="max-h-[500px] overflow-y-auto">
            {matchedOrders.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No matched orders
              </div>
            ) : (
              <div className="space-y-1">
                {matchedOrders.map((order, index) => (
                  <div 
                    key={`${order.time}-${index}`} 
                    className="grid grid-cols-4 gap-2 text-xs py-2 px-2 hover:bg-gray-50 rounded transition-colors"
                  >
                    {/* Time */}
                    <div className="text-center font-mono text-gray-500">
                      {order.time}
                    </div>

                    {/* Price */}
                    <div className={`text-center font-mono font-bold ${
                      order.change > 0 ? 'text-green-600' : 
                      order.change < 0 ? 'text-red-600' : 
                      'text-yellow-600'
                    }`}>
                      {order.price.toLocaleString()}
                    </div>
                    
                    {/* Last Size */}
                    <div className="text-center font-mono text-gray-700">
                      {order.last_size.toLocaleString()}
                    </div>
                    
                    {/* Change */}
                    <div className={`text-center font-mono font-semibold ${
                      order.change > 0 ? 'text-green-600' : 
                      order.change < 0 ? 'text-red-600' : 
                      'text-yellow-600'
                    }`}>
                      {order.change > 0 ? '+' : ''}{order.change.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {matchedOrders.length > 0 && (
            <div className="border-t border-gray-200 pt-3 px-2">
              <div className="text-center bg-gray-50 rounded p-2">
                <div className="text-gray-500">Total Orders</div>
                <div className="font-bold text-blue-600">{matchedOrders.length}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

