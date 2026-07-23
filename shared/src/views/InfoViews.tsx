import React from "react";
import { InfoPageLayout } from "../ui/InfoPageLayout";
import { Panel as SharedPanel } from "../ui/Panel";
import styles from "./InfoViews.module.css";

type InfoPanelProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export type InfoViewProps = {
  PanelComponent?: React.ComponentType<InfoPanelProps>;
};

function useInfoViewComponents(props: InfoViewProps) {
  return {
    PanelComponent: props.PanelComponent ?? SharedPanel,
  };
}

function Question(props: { question: string; children: React.ReactNode }) {
  return (
    <div className={styles.question}>
      <div className={styles.questionTitle}>{props.question}</div>
      <div className={styles.questionBody}>{props.children}</div>
    </div>
  );
}

export function FaqView(props: InfoViewProps) {
  const { PanelComponent } = useInfoViewComponents(props);
  return (
    <InfoPageLayout title="FAQ">
      <PanelComponent title="Common questions">
        <Question question="Where is my data stored?">
          Beholden stores campaigns locally on your machine. You can back up your campaigns by using the export feature, or backing up "Beholden.db".
        </Question>

        <Question question="Is this a VTT or a rules engine?">
          Neither... Beholden is a campaign tracker + combat helper. It does not try to enforce rules or replace your table.
        </Question>

        <Question question="Can I import monsters?">
          Yep! The compendium supports importing monster data. If you're missing a creature or a stat looks off,
          you can update the compendium or edit the monster directly in the app.
        </Question>

        <Question question="Does Beholden sync to the cloud?">
          Not by default. It's designed to work offline first. If you want sync, use a folder sync tool
          (Dropbox, Google Drive, etc.) on the data directory.
        </Question>

        <Question question="Why make this?">
          Because I used to use a great app named FightClub5e, but it stopped working and the developer disappeared.
          I wanted a free tool that did the same but better. My players also got spoiled by other character-sheet apps,
          so I've included some fun stuff like shared inventory, shared notes, and live damage.
        </Question>

        <Question question="When do updates come out?">
          When I have time and feel the app needs more. You can see my future endeavours on the updates page.
          I'm a solo indie dev with a day job, so updates come when they come. If you want to see something sooner,
          feel free to fork it on GitHub and submit a PR, or buy me a pizza to speed things up. 🍕
        </Question>

        <Question question="Why should I support you?">
          You don't have to. The code is at your disposal; feel free to remove the button using the ".env" file and
          setting SUPPORT=false (you'll have to restart the server). I won't lose sleep over it. I use this app myself,
          and I'll keep improving it whether people support me or not. But if you want to give me the fuzzies and help
          me feel validated, I'd appreciate it.
        </Question>

        <Question question="I have a great idea!">
          That's not a question. I'm open to collaborating with people. If you have an idea for a feature or improvement,
          feel free to reach out on GitHub. I can't promise I'll implement every suggestion, but I'm always happy to hear
          feedback and consider new ideas. Or just fork it!
        </Question>
      </PanelComponent>
    </InfoPageLayout>
  );
}

export function AboutView(props: InfoViewProps) {
  const { PanelComponent } = useInfoViewComponents(props);
  return (
    <InfoPageLayout title="About Beholden">
      <PanelComponent title="What is Beholden?" style={{ marginBottom: 12 }}>
        <div className={styles.aboutSection}>
          Beholden is a DM-first, offline-friendly campaign tracker for tabletop RPGs.
          It focuses on fast table flow to help with combat. I like to roll dice in person. I don't need a digital character sheet,
          initiative tracker, or monster stat block if it means opening another app or tab.
          Beholden is designed to stay out of the way and let you focus on the game.
        </div>
      </PanelComponent>

      <PanelComponent title="Design philosophy" style={{ marginBottom: 12 }}>
        <ul className={styles.list}>
          <li className={styles.aboutListItem}><b>Campaign-centric:</b> everything lives inside a campaign.</li>
          <li className={styles.aboutListItem}><b>Speed at the table:</b> fewer clicks, clearer state changes.</li>
          <li className={styles.aboutListItem}><b>Offline-friendly:</b> data is stored locally on disk.</li>
          <li className={styles.aboutListItem}><b>No magic wiring:</b> explicit data flow and predictable behavior.</li>
        </ul>
      </PanelComponent>

      <PanelComponent title="Who made this?">
        <div style={{ lineHeight: 1.6 }}>
          Beholden is made by an indie DM who wanted a tool that stays out of the way.
          If you'd like to support development, hit the pizza button in the footer. 🍕
        </div>
      </PanelComponent>
    </InfoPageLayout>
  );
}

export function UpdatesView(props: InfoViewProps) {
  const { PanelComponent } = useInfoViewComponents(props);
  return (
    <InfoPageLayout title="Future Updates">
      <PanelComponent title="Roadmap" style={{ marginBottom: 12 }}>
        <ul className={styles.updateList}>
          <li><b>Rulesets:</b> Full 5e support, including Grand Schema content conversion, campaign ruleset selection, and compendium filtering</li>
          <li><b>Ongoing:</b> Bug fixes</li>
          <li><b>NPC Tracker:</b> A large people, timeline, relationship, organization, and location system</li>
        </ul>
      </PanelComponent>
    </InfoPageLayout>
  );
}
