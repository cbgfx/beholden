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
          Locally on your machine, where it belongs. You own your data. I don't want your data; I have enough of my own clutter.
           If you lose it because you didn't use the export feature or back up Beholden.db, that’s between you and your gods.
        </Question>

        <Question question="Is this a VTT or a rules engine?">
          Neither... Beholden is a campaign tracker + combat helper. It does not try to enforce (all) rules or replace your table. Talk to your friends.
        </Question>

        <Question question="Can I import monsters?">
          Yep! The compendium supports importing monster data. If you're missing a creature or a stat looks off,
          you can update the compendium or edit the monster directly in the app. It also allows you to add items, feats, backgrounds, spells, etc..
        </Question>

        <Question question="Does Beholden sync to the cloud?">
          No. But you can run it on a server on railway for example, and then share the URL with your players. Anyway you can deploy the app works.
        </Question>

        <Question question="Why make this?">
          Because I used to use a great app named FightClub5e, but it stopped working and the developer disappeared into a Bag of Holding.
          I wanted a free tool that did the same but better. My players also got spoiled by other character-sheet apps,
          so I've included some fun stuff like shared inventory, shared notes, and live damage.
        </Question>

        <Question question="When do updates come out?">
          When I have time and feel the app needs more. You can see my future endeavours on the updates page.
          I'm a solo indie dev with a day job, so updates come when they come. If you want to see something sooner,
          feel free to fork it on GitHub and submit a PR, or support me to speed things up.
        </Question>

        <Question question="Why should I support you?">
          Honestly? You don't have to. The code is open—if my support button offends you, set SUPPORT=false in your .env file, 
          restart the server, and make it disappear. I’ll keep building this because I use it for my own games regardless. 
          But if you do send a tip, you get to feel generous and I get warm fuzzy validation. Win-win.
        </Question>

        <Question question="I have a great idea!">
          That's not a question. I'm open to collaborating with people. If you have an idea for a feature or improvement,
          feel free to reach out on GitHub. I can't promise I'll implement every suggestion, but I'm always happy to hear
          feedback and consider new ideas. Or just fork it!
        </Question>

        <Question question="I noticed AI features... I hate AI.">
        It's literally just a system prompt. The app isn't running rogue neural nets in the background—it just gives you Markdown
         to hand to an LLM so it spits out clean, valid JSON for Beholden to read. It’s an optional tool to save you from hand-coding
          stat blocks. If you don't want to use it, don't copy the text. Problem solved.
        </Question>

        <Question question="I don't like <insert thing> about this app.">
          Oh. Well, that's too bad. I made this app for me and my friends, and it works for us. 
          If you don't like it, you can fork it and change it to your liking.
          You sure as hell can’t complain about a year of work that I’m giving away for free.
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
          Beholden is an offline-friendly campaign tracker for tabletop RPGs who'd rather spend game night actually playing than wrestling with 20 tabs.
          It focuses on fast table flow whether you are running the world or tracking how you will collect a goblin's head.          
          Beholden is designed to stay out of the way and let you focus on the game while rolling REAL dice. It is not a VTT.
        </div>
      </PanelComponent>

      <PanelComponent title="Design philosophy" style={{ marginBottom: 12 }}>
        <ul className={styles.list}>
          <li className={styles.aboutListItem}><b>Campaign-centric:</b> everything stays organized where it belongs.</li>
          <li className={styles.aboutListItem}><b>Speed at the table:</b> fewer clicks, and instant clarity.</li>
          <li className={styles.aboutListItem}><b>Offline-friendly:</b> data is stored locally on disk.</li>
          <li className={styles.aboutListItem}><b>No magic wiring:</b> explicit data flow and predictable behavior.</li>
        </ul>
      </PanelComponent>

      <PanelComponent title="Who made this?">
        <div style={{ lineHeight: 1.6 }}>
          Beholden is made by an indie DM who wanted a tool that isn't bloated and actually serves his table.
          I just wanted something that works. I got fed up of half-baked apps that don't do what I want. This may not be your cup of tea, but it is mine.
          I have solid foundations here, and I will continue to build on them. If you like it, support me. If you think you can do better, fork it. 
          If you have ideas, submit a PR. If you have complaints, scream it into the void, it's free, you don't get to complain about a year's work.
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
          <li><b>Ongoing:</b> Bug fixes</li>
          <li><b>NPC Tracker:</b> A large people, timeline, relationship, organization, and location system</li>
        </ul>
      </PanelComponent>
    </InfoPageLayout>
  );
}
