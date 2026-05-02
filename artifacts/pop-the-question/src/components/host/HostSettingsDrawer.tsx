import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tv,
  ScreenShare,
  Maximize2,
  Minimize2,
  Mic,
  Type as TypeIcon,
  Headphones,
  Volume2,
  Music,
  Eye,
} from "lucide-react";
import {
  useHostSettings,
  updateHostSettings,
  resetHostSettings,
  FONT_SIZE_LABELS,
  type HostFontSize,
  type HostMode,
  type HostAnswerMethod,
} from "@/lib/hostSettings";
import { setMuted, getMuted } from "@/lib/sfx";
import { toggleFullscreen, useFullscreenState } from "@/lib/fullscreen";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called when answer method changes — host page emits to socket. */
  onAnswerMethodChange?: (m: HostAnswerMethod) => void;
}

const FONT_OPTIONS: HostFontSize[] = ["normal", "large", "huge"];

export function HostSettingsDrawer({ open, onOpenChange, onAnswerMethodChange }: Props) {
  const settings = useHostSettings();
  const isFs = useFullscreenState();
  // Mirror SFX mute state into the settings UI on every open, since the
  // global MuteToggle (top-right) can change it independently.
  const [sfxOn, setSfxOn] = useState<boolean>(() => !getMuted());

  useEffect(() => {
    if (open) setSfxOn(!getMuted());
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] overflow-y-auto" data-testid="host-settings-drawer">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-display font-extrabold tracking-tight">
            Host Settings
          </DrawerTitle>
          <DrawerDescription>
            Tune the experience for your room. Saved on this device.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 max-w-2xl mx-auto w-full">
          {/* ============ MODE ============ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Display Mode
            </h3>
            <RadioGroup
              value={settings.mode}
              onValueChange={(v: string) =>
                updateHostSettings({ mode: v as HostMode, modeOverridden: true })
              }
              className="grid grid-cols-2 gap-3"
            >
              <ModeCard
                value="in-person"
                checked={settings.mode === "in-person"}
                Icon={Tv}
                title="In-Person"
                desc="TV / projector — minimal chrome, big text."
                testId="mode-in-person"
              />
              <ModeCard
                value="remote"
                checked={settings.mode === "remote"}
                Icon={ScreenShare}
                title="Remote"
                desc="Screen-share — safe-zone padding, status badges."
                testId="mode-remote"
              />
            </RadioGroup>
          </section>

          <Separator />

          {/* ============ TYPOGRAPHY ============ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Typography
            </h3>
            <Label className="text-sm font-bold mb-2 block">Font size</Label>
            <div className="grid grid-cols-3 gap-2">
              {FONT_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant={settings.fontSize === opt ? "default" : "outline"}
                  className={
                    settings.fontSize === opt
                      ? "font-bold"
                      : "font-bold border-border/60"
                  }
                  onClick={() => updateHostSettings({ fontSize: opt })}
                  data-testid={`fontsize-${opt}`}
                >
                  <span
                    style={{
                      fontSize:
                        opt === "normal" ? "0.95em" : opt === "large" ? "1.05em" : "1.15em",
                    }}
                  >
                    {FONT_SIZE_LABELS[opt]}
                  </span>
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-5">
              <Label htmlFor="contrast-switch" className="flex items-center gap-2 cursor-pointer">
                <Eye className="w-4 h-4" />
                <span className="font-bold text-sm">High Contrast</span>
              </Label>
              <Switch
                id="contrast-switch"
                checked={settings.highContrast}
                onCheckedChange={(v) => updateHostSettings({ highContrast: Boolean(v) })}
                data-testid="toggle-high-contrast"
              />
            </div>
          </section>

          <Separator />

          {/* ============ DISPLAY ============ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Display
            </h3>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 font-bold"
              onClick={() => toggleFullscreen()}
              data-testid="btn-fullscreen"
            >
              {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                or press F11
              </span>
            </Button>
          </section>

          <Separator />

          {/* ============ AUDIO ============ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Audio
            </h3>

            <div className="flex items-center justify-between mb-3">
              <Label htmlFor="sfx-switch" className="flex items-center gap-2 cursor-pointer">
                <Volume2 className="w-4 h-4" />
                <span className="font-bold text-sm">Sound Effects</span>
              </Label>
              <Switch
                id="sfx-switch"
                checked={sfxOn}
                onCheckedChange={(v) => {
                  const enabled = Boolean(v);
                  setSfxOn(enabled);
                  setMuted(!enabled);
                  updateHostSettings({ soundEffects: enabled });
                }}
                data-testid="toggle-sfx"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="music-switch" className="flex items-center gap-2 cursor-pointer">
                <Music className="w-4 h-4" />
                <div>
                  <span className="font-bold text-sm">Background Music</span>
                  <p className="text-xs text-muted-foreground font-normal">
                    Coming soon — toggle saved for next release.
                  </p>
                </div>
              </Label>
              <Switch
                id="music-switch"
                checked={settings.music}
                onCheckedChange={(v) => updateHostSettings({ music: Boolean(v) })}
                data-testid="toggle-music"
              />
            </div>
          </section>

          <Separator />

          {/* ============ TIMER ============ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Default Question Timer
            </h3>
            <div className="flex items-center gap-4">
              <Slider
                value={[settings.timerSeconds]}
                onValueChange={([v]) =>
                  updateHostSettings({ timerSeconds: Math.round(v) })
                }
                min={15}
                max={120}
                step={5}
                data-testid="slider-timer"
                className="flex-1"
              />
              <div className="text-2xl font-bold font-mono w-20 text-right">
                {settings.timerSeconds}s
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Used by upcoming buzz-in game modes.
            </p>
          </section>

          <Separator />

          {/* ============ ANSWER METHOD ============ */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Answer Method
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              How players submit answers when a game supports both.
            </p>
            <RadioGroup
              value={settings.answerMethod}
              onValueChange={(v: string) => {
                const method = v as HostAnswerMethod;
                updateHostSettings({ answerMethod: method });
                onAnswerMethodChange?.(method);
              }}
              className="grid gap-2"
            >
              <AnswerMethodRow
                value="voice"
                checked={settings.answerMethod === "voice"}
                Icon={Mic}
                label="Voice Only"
                desc="Players shout, host taps the right answer."
                testId="answer-voice"
              />
              <AnswerMethodRow
                value="text"
                checked={settings.answerMethod === "text"}
                Icon={TypeIcon}
                label="Text Only"
                desc="Players type on their phones — quieter rooms."
                testId="answer-text"
              />
              <AnswerMethodRow
                value="both"
                checked={settings.answerMethod === "both"}
                Icon={Headphones}
                label="Both"
                desc="Players choose what works for the moment."
                testId="answer-both"
              />
            </RadioGroup>
          </section>

          <Separator />

          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              resetHostSettings();
              setSfxOn(true);
              setMuted(false);
            }}
            data-testid="btn-reset-settings"
          >
            Reset to Defaults
          </Button>
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button className="w-full font-bold" data-testid="btn-close-settings">
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function ModeCard({
  value,
  checked,
  Icon,
  title,
  desc,
  testId,
}: {
  value: string;
  checked: boolean;
  Icon: typeof Tv;
  title: string;
  desc: string;
  testId: string;
}) {
  return (
    <Label
      htmlFor={`mode-${value}`}
      className={`relative flex flex-col gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all ${
        checked
          ? "border-primary bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]"
          : "border-border bg-card/50 hover:bg-card"
      }`}
      data-testid={testId}
    >
      <RadioGroupItem value={value} id={`mode-${value}`} className="sr-only" />
      <Icon className={`w-6 h-6 ${checked ? "text-primary" : "text-muted-foreground"}`} />
      <div>
        <div className="font-bold text-base">{title}</div>
        <div className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</div>
      </div>
    </Label>
  );
}

function AnswerMethodRow({
  value,
  checked,
  Icon,
  label,
  desc,
  testId,
}: {
  value: string;
  checked: boolean;
  Icon: typeof Mic;
  label: string;
  desc: string;
  testId: string;
}) {
  return (
    <Label
      htmlFor={`am-${value}`}
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        checked
          ? "border-secondary bg-secondary/10"
          : "border-border bg-card/40 hover:bg-card"
      }`}
      data-testid={testId}
    >
      <RadioGroupItem value={value} id={`am-${value}`} className="mt-0.5" />
      <div className="flex items-center gap-2 flex-1">
        <Icon className={`w-4 h-4 ${checked ? "text-secondary" : "text-muted-foreground"}`} />
        <div>
          <div className="font-bold text-sm">{label}</div>
          <div className="text-xs text-muted-foreground leading-snug">{desc}</div>
        </div>
      </div>
    </Label>
  );
}
