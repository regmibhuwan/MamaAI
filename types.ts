export enum AppScreen {
  HOME = 'HOME',
  INGREDIENT_INPUT = 'INGREDIENT_INPUT',
  RECIPE_SELECTION = 'RECIPE_SELECTION',
  PREP_DETAILS = 'PREP_DETAILS',
  LIVE_COOKING = 'LIVE_COOKING',
}

export interface Ingredient {
  name: string;
  amount?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  time: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  calories?: string;
  ingredients: string[];
  equipment: string[];
  steps: string[];
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export enum LiveStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}