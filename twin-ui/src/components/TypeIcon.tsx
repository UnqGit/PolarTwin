import React from 'react';
import { 
  Building2, Building, Package, Server, Layers, 
  Zap, Radio, Settings2, Battery, Cog, 
  Droplet, Database, Bell, ToggleRight, Thermometer, Box 
} from 'lucide-react';

export const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const t = (type || '').toLowerCase();
  
  let IconComponent = Box;
  
  if (t.includes('campus')) IconComponent = Building2;
  else if (t.includes('station')) IconComponent = Building;
  else if (t.includes('block')) IconComponent = Package;
  else if (t.includes('subsystem')) IconComponent = Layers;
  else if (t.includes('system')) IconComponent = Server;
  else if (t.includes('generator')) IconComponent = Zap;
  else if (t.includes('sensor')) IconComponent = Radio;
  else if (t.includes('controller')) IconComponent = Settings2;
  else if (t.includes('battery')) IconComponent = Battery;
  else if (t.includes('motor')) IconComponent = Cog;
  else if (t.includes('pump')) IconComponent = Droplet;
  else if (t.includes('tank')) IconComponent = Database;
  else if (t.includes('alarm')) IconComponent = Bell;
  else if (t.includes('toggle')) IconComponent = ToggleRight;
  else if (t.includes('thermometer')) IconComponent = Thermometer;

  return <IconComponent size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />;
};
