export interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  isBot?: boolean;
  score?: number;
}
