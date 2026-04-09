from datetime import date, datetime

from quant_kernel.portfolio_engine import LotStatus, PositionLot
from quant_sim.stockpolicy_core import LotStatus as CompatLotStatus
from quant_sim.stockpolicy_core import PositionLot as CompatPositionLot


def test_position_lot_follows_t_plus_one_availability():
    lot = PositionLot(
        lot_id="lot-1",
        entry_time=datetime(2026, 4, 8, 10, 0, 0),
        entry_date=date(2026, 4, 8),
        original_quantity=100,
        remaining_quantity=100,
        entry_price=10.2,
        status=LotStatus.LOCKED,
        unlock_date=date(2026, 4, 9),
    )

    assert lot.is_available(date(2026, 4, 8)) is False
    assert lot.is_available(date(2026, 4, 9)) is True


def test_quant_sim_stockpolicy_core_reexports_quant_kernel_ledger_types():
    assert CompatLotStatus is LotStatus
    assert CompatPositionLot is PositionLot
