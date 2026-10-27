// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { buildCharacterHpActions } from "./CharacterViewHpActions";
import type { Character } from "../CharacterViewHelpers";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/services/api", () => ({ api: h.api, jsonInit: (method:string,body:unknown) => ({method,body}) }));
it("healing reads authoritative HP and cleared saves from the real nested API response", async () => {
  let character = { id:"hero", hpCurrent:0, conditions:[], deathSaves:{success:2,fail:1} } as unknown as Character;
  h.api.mockResolvedValue({id:"hero",userId:"owner",sheet:{name:"Hero",level:1,hpMax:10},live:{hpCurrent:4,conditions:[],deathSaves:{success:0,fail:0}},campaigns:[],characterData:null,isActive:true});
  const noop=()=>{};
  const actions=buildCharacterHpActions({char:character,setChar:update=>{character=typeof update==='function'?update(character)!:update!;},hpAmount:"4",setHpAmount:noop,setLastRoll:noop,flashRef:{current:null},hpInputRef:{current:null},setHpError:noop,setHpSaving:noop,setConcentrationAlert:noop,effectiveHpMax:10,overrides:{tempHp:0,acBonus:0,hpMaxBonus:0},polymorphCondition:null,revertPolymorph:async()=>{}});
  await actions.applyHp("heal");
  expect(character.hpCurrent).toBe(4);
  expect(character.deathSaves).toEqual({success:0,fail:0});
});
