import React from "react";
import type { Action } from "@/store/actions";
import { reducer } from "@/store/reducer";
import { initialState, type State } from "@/store/state";

type StoreCtx = { state: State; dispatch: React.Dispatch<Action> };

const Ctx = React.createContext<StoreCtx | null>(null);

export function StoreProvider(props: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const value = React.useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
