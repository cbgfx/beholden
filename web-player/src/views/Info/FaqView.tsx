import React from "react";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { InfoPageLayout } from "./InfoPageLayout";

function Q(props: { q: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{props.q}</div>
      <div style={{ color: C.text, lineHeight: 1.55 }}>{props.children}</div>
    </div>
  );
}

export function FaqView() {
  return (
    <InfoPageLayout title="FAQ">
      <Panel title="Common questions">
        <Q q="Where is my data stored?">
          Beholden stores campaigns locally on your machine. You can back up your campaigns by using the export feature, or backing up "Beholden.db".
        </Q>

        <Q q="Is this a VTT or a rules engine?">
          Neither... Beholden is a campaign tracker + combat helper. It does not try to enforce rules or replace your table.
        </Q>

        <Q q="Can I import monsters?">
          Yep! the compendium supports importing monster data. If you're missing a creature or a stat looks off,
          you can update the compendium or edit the monster directly in the app.
        </Q>

        <Q q="Does Beholden sync to the cloud?">
          Not by default. It's designed to work offline first. If you want sync, use a folder sync tool (Dropbox, Google Drive, etc.).
          on the data directory.
        </Q>

        <Q q="Why make this?">
          Because I used to use a great app named FightClub5e, but it stopped working and the developer disappeared. I wanted a free tool that did the same but better. My players also got spoiled by other Character Sheet apps, so I've included some fun stuff like Shared Inventory / Shared Notes and live damage.
        </Q>

        <Q q="When do updates come out?">
          When I have time, and feel the app needs more. You can see my future endeavours on the updates page. I'm a solo indie dev with a dayjob, so updates come when they come. If you want to see something sooner, feel free to fork it on GitHub and submit a PR, or buy me a pizza to speed things up. 🍕
        </Q>

        <Q q="Why should I support you?">
          You don't have to. The code is at your disposal, feel free to remove the button using the ".env" file and setting SUPPORT=false (you'll have to restart the server). I won't lose sleep over it. I use this app myself, and I'll keep improving it whether people support me or not.
          But if you want to give me the fuzzies and help me feel validated, I'd appreciate it.
        </Q>

        <Q q="I have a great idea!">
          That's not a question. I'm open to collaborating with people. If you have an idea for a feature or improvement, feel free to reach out on GitHub. I can't promise I'll implement every suggestion, but I'm always happy to hear feedback and consider new ideas. Or just fork it!
        </Q>
      </Panel>
    </InfoPageLayout>
  );
}
