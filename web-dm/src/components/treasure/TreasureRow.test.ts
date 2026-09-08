import { expect, it, vi } from "vitest";
import type { TreasureEntry } from "@/domain/types/domain";
import { TreasureRow } from "./TreasureRow";

function setup(qty: number) {
  const updateQty = vi.fn();
  const remove = vi.fn();
  const onAward = vi.fn();
  const onClick = vi.fn();
  const row = TreasureRow({ item: { id: "loot", name: "Arrows", qty } as TreasureEntry,
    updateQty, remove, onAward, onClick });
  const trailing = row.props.trailing;
  const [award, stepper, deletion] = trailing.props.children;
  return { row, trailing, award, stepper, deletion, updateQty, remove, onAward, onClick };
}

it("uses the same item ID for quantity, award and delete actions", () => {
  const view = setup(3);
  view.stepper.props.onIncrement();
  view.stepper.props.onDecrement();
  view.award.props.onClick();
  view.deletion.props.onClick();
  expect(view.updateQty.mock.calls).toEqual([["loot", 4], ["loot", 2]]);
  expect(view.remove).toHaveBeenCalledWith("loot");
  expect(view.onAward).toHaveBeenCalledOnce();
});

it("prevents decrementing below one and keeps action clicks out of the detail drawer", () => {
  const view = setup(1);
  expect(view.stepper.props.decrementDisabled).toBe(true);
  expect(view.stepper.props.onDecrement).toBeUndefined();
  const stopPropagation = vi.fn();
  view.trailing.props.onClick({ stopPropagation });
  expect(stopPropagation).toHaveBeenCalledOnce();
  expect(view.onClick).not.toHaveBeenCalled();
  view.row.props.onClick();
  expect(view.onClick).toHaveBeenCalledOnce();
});
