/**
 * The Schedule card of an offer editor (Pro, lib/schedule.ts): an optional start and end, in the store's time zone.
 * The app switches the offer on at the start and off at the end.
 */
import type { LocalMoment, ScheduleInput } from "../lib/schedule";
import { TIMES } from "../lib/schedule";
import { Button, DateField, Select, Switch } from "./fields";
import { Pill } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
// New times start tomorrow, so a fresh schedule is never in the past.
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const TIME_OPTIONS = TIMES.map((t) => ({ value: t, label: t }));

function Moment(props: { label: string; value: LocalMoment; onValue: (v: LocalMoment) => void; min: string }) {
  return (
    <s-grid gridTemplateColumns="minmax(0, 2fr) minmax(0, 1fr)" gap="base" alignItems="end">
      <DateField label={`${props.label} date`} allow={`${props.min}--`} value={props.value.date} onValue={(date) => props.onValue({ ...props.value, date })} />
      <Select label="Time" value={props.value.time} onValue={(time) => props.onValue({ ...props.value, time })} options={TIME_OPTIONS} />
    </s-grid>
  );
}

export function ScheduleCard(props: { value: ScheduleInput; onValue: (v: ScheduleInput) => void; timeZone: string; pro: boolean }) {
  const { value, onValue } = props;
  return (
    <s-section heading="Schedule">
      <s-stack gap="base">
        {props.pro ? (
          <>
            <s-text color="subdued">{`The app switches this offer on at the start and off at the end. Times are in your store's time zone (${props.timeZone}).`}</s-text>
            {/* The switches follow the value, so Discard puts them back too. */}
            <s-stack gap="small-200">
              <Switch label="Start at a set time" details="Off until then." checked={!!value.start} onValue={(on) => onValue({ ...value, start: on ? { date: tomorrow(), time: "09:00" } : null })} />
              {value.start ? <Moment label="Start" min={today()} value={value.start} onValue={(start) => onValue({ ...value, start })} /> : null}
            </s-stack>
            <s-stack gap="small-200">
              <Switch label="End at a set time" details="Switched off then." checked={!!value.end} onValue={(on) => onValue({ ...value, end: on ? { date: value.start?.date ?? tomorrow(), time: "23:30" } : null })} />
              {value.end ? <Moment label="End" min={value.start?.date ?? today()} value={value.end} onValue={(end) => onValue({ ...value, end })} /> : null}
            </s-stack>
          </>
        ) : (
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-text color="subdued">Start and end this offer at set times, like a weekend sale.</s-text>
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <Pill>Pro plan</Pill>
              <Button href="/app/plans">See the plans</Button>
            </s-stack>
          </s-stack>
        )}
      </s-stack>
    </s-section>
  );
}
