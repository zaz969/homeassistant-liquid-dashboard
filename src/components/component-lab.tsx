"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Fan,
  Lightbulb,
  Music2,
  RotateCcw,
  Sparkles,
  Thermometer,
  Wifi,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/glass/card";
import { Button } from "@/components/ui/glass/button";
import { Badge } from "@/components/ui/glass/badge";
import { Input } from "@/components/ui/glass/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/glass/select";
import { Slider } from "@/components/ui/glass/slider";
import { Switch } from "@/components/ui/glass/switch";
import WallpaperCanvas from "@/components/wallpaper-canvas";
import { wallpaperPresets, type ThemeSettings } from "@/lib/theme";

export default function ComponentLab() {
  const [wallpaper, setWallpaper] = useState<ThemeSettings["wallpaper"]>("ribbons");
  const [lightOn, setLightOn] = useState(true);
  const [fanOn, setFanOn] = useState(false);
  const [brightness, setBrightness] = useState([68]);
  const [temperature, setTemperature] = useState([22]);
  const [roomName, setRoomName] = useState("Living room");
  const [scene, setScene] = useState("relax");

  function reset() {
    setLightOn(true);
    setFanOn(false);
    setBrightness([68]);
    setTemperature([22]);
    setRoomName("Living room");
    setScene("relax");
  }

  return (
    <main className="dashboard-shell component-lab-shell">
      <WallpaperCanvas wallpaper={wallpaper} colors={{ backgroundA: "#18112d", backgroundB: "#3a2456", backgroundC: "#13304a", accent: "#ff795f" }} animated speed="slow" />
      <header className="lab-header">
        <div className="lab-brand">
          <div className="lab-brand-icon"><Sparkles size={21} /></div>
          <div>
            <p className="lab-eyebrow">LOCAL DEVELOPMENT</p>
            <h1>Glass UI Component Lab</h1>
          </div>
        </div>
        <div className="lab-header-actions">
          <Select value={wallpaper} onValueChange={(value) => setWallpaper(value as ThemeSettings["wallpaper"])}>
            <SelectTrigger aria-label="Preview wallpaper"><SelectValue /></SelectTrigger>
            <SelectContent>
              {wallpaperPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            effect="glow"
            onClick={reset}
            aria-label="Reset component states"
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </Button>
        </div>
      </header>

      <div className="lab-meta">
        <Badge className="lab-meta-badge"><Wifi size={13} /> Mock controls</Badge>
        <span>Changes stay in this browser session and never call Home Assistant.</span>
      </div>

      <div className="lab-grid">
        <Card className="lab-card lab-device" hover="glow">
          <CardHeader className="lab-card-header">
            <div className="lab-card-icon lab-icon-amber"><Lightbulb size={19} /></div>
            <div className="lab-heading-copy">
              <CardTitle>Toggle control</CardTitle>
              <CardDescription>Glass switch · on and off states</CardDescription>
            </div>
            <Badge className={`lab-state ${lightOn ? "is-active" : ""}`}>
              {lightOn ? "On" : "Off"}
            </Badge>
          </CardHeader>
          <CardContent className="lab-card-content">
            <div className="lab-device-title">{roomName} lights</div>
            <div className="lab-control-row">
              <span>Power</span>
              <Switch
                checked={lightOn}
                onCheckedChange={setLightOn}
                aria-label="Living room lights"
                glow={lightOn}
              />
            </div>
            <div className="lab-control-row lab-range-row">
              <label htmlFor="brightness-slider">Brightness <strong>{brightness[0]}%</strong></label>
              <Slider
                id="brightness-slider"
                aria-label="Brightness"
                value={brightness}
                onValueChange={setBrightness}
                min={0}
                max={100}
                step={1}
                disabled={!lightOn}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lab-card lab-climate" gradient hover="glow">
          <CardHeader className="lab-card-header">
            <div className="lab-card-icon lab-icon-blue"><Thermometer size={19} /></div>
            <div className="lab-heading-copy">
              <CardTitle>Climate control</CardTitle>
              <CardDescription>Slider thumb and value states</CardDescription>
            </div>
            <Badge className="lab-state">Auto</Badge>
          </CardHeader>
          <CardContent className="lab-card-content">
            <div className="lab-temperature"><span>{temperature[0]}</span><sup>°</sup><small>C</small></div>
            <p className="lab-supporting-text">Target temperature</p>
            <Slider
              aria-label="Target temperature"
              value={temperature}
              onValueChange={setTemperature}
              min={16}
              max={30}
              step={1}
            />
            <div className="lab-slider-labels"><span>16°</span><span>30°</span></div>
          </CardContent>
        </Card>

        <Card className="lab-card lab-controls" hover="lift">
          <CardHeader className="lab-card-header">
            <div className="lab-card-icon lab-icon-violet"><Fan size={19} /></div>
            <div className="lab-heading-copy">
              <CardTitle>Control samples</CardTitle>
              <CardDescription>Switch, input, select and badge</CardDescription>
            </div>
            <Badge className={`lab-state ${fanOn ? "is-active" : ""}`}>
              {fanOn ? "Running" : "Idle"}
            </Badge>
          </CardHeader>
          <CardContent className="lab-card-content lab-form">
            <div className="lab-control-row">
              <label htmlFor="fan-switch">Desk fan</label>
              <Switch
                id="fan-switch"
                checked={fanOn}
                onCheckedChange={setFanOn}
                aria-label="Desk fan"
              />
            </div>
            <label className="lab-field">
              <span>Room label</span>
              <Input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                aria-label="Room label"
                placeholder="Name this room"
              />
            </label>
            <div className="lab-field">
              <span>Scene preset</span>
              <Select value={scene} onValueChange={setScene}>
                <SelectTrigger aria-label="Scene preset">
                  <SelectValue placeholder="Choose a scene" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relax">Relax</SelectItem>
                  <SelectItem value="focus">Focus</SelectItem>
                  <SelectItem value="movie">Movie night</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="lab-selection" role="status">
              Active scene: <strong>{scene}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="lab-card lab-styles" hover="glow">
          <CardHeader className="lab-card-header">
            <div className="lab-card-icon lab-icon-pink"><Music2 size={19} /></div>
            <div className="lab-heading-copy">
              <CardTitle>Surface & actions</CardTitle>
              <CardDescription>Card materials, button variants and badges</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="lab-card-content">
            <div className="lab-style-swatches">
              <div className="lab-swatch regular"><span>Regular</span></div>
              <div className="lab-swatch clear"><span>Clear</span></div>
              <div className="lab-swatch tinted"><span>Tinted</span></div>
            </div>
            <div className="lab-button-row">
              <Button effect="shimmer" onClick={() => setScene("movie")}>
                <Sparkles size={15} /> Shimmer
              </Button>
              <Button variant="outline" effect="glow" onClick={() => setScene("focus")}>
                Outline
              </Button>
              <Button
                variant="liquid"
                material="tinted"
                tint="#38bdf8"
                onClick={() => setScene("relax")}
              >
                <Check size={15} /> Tinted
              </Button>
            </div>
            <div className="lab-badge-row" aria-label="Badge states">
              <Badge className="lab-pill-positive">Connected</Badge>
              <Badge material="clear" className="lab-pill-neutral">Clear glass</Badge>
              <Badge material="tinted" tint="#a855f7" className="lab-pill-tinted">Active scene</Badge>
            </div>
            <div className="lab-media-preview">
              <div className="lab-album-art"><Music2 size={19} /></div>
              <div><strong>Night Drive</strong><span>Ambient playlist</span></div>
              <Button size="icon" effect="glow" aria-label="Open media preview">
                <ArrowUpRight size={17} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="lab-footer">
        <span>Development-only showcase</span>
        <span>Refresh to discard the current test state</span>
      </footer>
    </main>
  );
}
