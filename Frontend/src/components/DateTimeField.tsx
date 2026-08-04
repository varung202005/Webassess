import { useEffect, useState } from "react";

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  ariaLabel?: string;
}

function toTwelveHourTime(time: string) {
  if (!time) return { hour: "", minute: "", period: "AM" as const };
  const [hours = "0", minutes = "0"] = time.split(":");
  const hour24 = Number(hours);
  return {
    hour: String(hour24 % 12 || 12).padStart(2, "0"),
    minute: String(Number(minutes)).padStart(2, "0"),
    period: hour24 >= 12 ? "PM" as const : "AM" as const,
  };
}

function toTwentyFourHourTime(hour: number, minute: number, period: "AM" | "PM") {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Date remains typeable through the native date input. Time uses a compact,
 * editable 12-hour spinner so users can type a value or adjust it with the
 * controls, without exposing a 24-hour time field.
 */
export default function DateTimeField({ value, onChange, className = "form-input", required, ariaLabel }: DateTimeFieldProps) {
  const [date = "", time = ""] = value.split("T");
  const parsedTime = toTwelveHourTime(time);
  const [hour, setHour] = useState(parsedTime.hour);
  const [minute, setMinute] = useState(parsedTime.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsedTime.period);

  useEffect(() => {
    const next = toTwelveHourTime(time);
    setHour(next.hour);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [time]);

  const update = (nextDate: string, nextTime: string) => {
    onChange(nextDate || nextTime ? `${nextDate}T${nextTime}` : "");
  };

  const commitTime = (nextHour = hour, nextMinute = minute, nextPeriod = period) => {
    const normalizedHour = Math.min(12, Math.max(1, Number(nextHour) || 12));
    const normalizedMinute = Math.min(59, Math.max(0, Number(nextMinute) || 0));
    const normalizedHourText = String(normalizedHour).padStart(2, "0");
    const normalizedMinuteText = String(normalizedMinute).padStart(2, "0");
    setHour(normalizedHourText);
    setMinute(normalizedMinuteText);
    setPeriod(nextPeriod);
    update(date, toTwentyFourHourTime(normalizedHour, normalizedMinute, nextPeriod));
  };

  const adjust = (part: "hour" | "minute", amount: number) => {
    const current = part === "hour" ? (Number(hour) || 12) : (Number(minute) || 0);
    const limit = part === "hour" ? 12 : 60;
    const next = ((current - (part === "hour" ? 1 : 0) + amount + limit) % limit) + (part === "hour" ? 1 : 0);
    commitTime(part === "hour" ? String(next) : hour, part === "minute" ? String(next) : minute);
  };

  const commitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commitTime();
  };

  return (
    <div className="date-time-field">
      <input
        type="date"
        className={className}
        value={date}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} date` : "Date"}
        onChange={(event) => update(event.target.value, time)}
      />
      <div className="time-spinner" aria-label={ariaLabel ? `${ariaLabel} time` : "Time"}>
        <div className="time-spinner-part">
          <button type="button" onClick={() => adjust("hour", 1)} aria-label="Increase hour"><i className="ti ti-chevron-up" /></button>
          <input value={hour} inputMode="numeric" maxLength={2} placeholder="HH" aria-label="Hour"
            onChange={(event) => setHour(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={() => commitTime()} onKeyDown={commitOnEnter} />
          <button type="button" onClick={() => adjust("hour", -1)} aria-label="Decrease hour"><i className="ti ti-chevron-down" /></button>
        </div>
        <span className="time-spinner-separator">:</span>
        <div className="time-spinner-part">
          <button type="button" onClick={() => adjust("minute", 1)} aria-label="Increase minute"><i className="ti ti-chevron-up" /></button>
          <input value={minute} inputMode="numeric" maxLength={2} placeholder="MM" aria-label="Minute"
            onChange={(event) => setMinute(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={() => commitTime()} onKeyDown={commitOnEnter} />
          <button type="button" onClick={() => adjust("minute", -1)} aria-label="Decrease minute"><i className="ti ti-chevron-down" /></button>
        </div>
        <div className="time-spinner-period" aria-label="AM or PM">
          {(["AM", "PM"] as const).map((option) => (
            <button key={option} type="button" className={period === option ? "active" : ""}
              onClick={() => commitTime(hour, minute, option)}>{option}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
