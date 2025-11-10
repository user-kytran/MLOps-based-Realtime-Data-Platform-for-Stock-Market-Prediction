from fastapi import APIRouter
from .routers.stocks import stock_router
from .routers.news import new_router


router = APIRouter()

router.include_router(stock_router, prefix="/stocks", tags=["stocks"])
router.include_router(new_router, prefix="/news", tags=["news"])
