export type Coach = {
  id?: string;
  name: string;
  position?: string;
  season?: string;
  photo?: string;
  bio?: string;
  data?: {
    bio?: string;
  };
};

export type Player = {
  id?: string;
  name: string;
  email?: string | null;
  season?: string;
  year?: string;
  number?: string | number;
  position?: string;
  classYear?: string;
  height?: string;
  weight?: string;
  hometown?: string;
  state?: string;
  highSchool?: string;
  previousSchool?: string;
  photo?: string;
  balance?: number;
  userID?: string;
  data?: Record<string, string | null | undefined>;
};

export type RosterFormData = {
  name: string;
  number: string;
  position: string;
  height: string;
  weight: string;
  classYear: string;
  hometown: string;
  state: string;
  highSchool: string;
  previousSchool: string;
  bio: string;
  photo: File | string | null;
  userID: string;
  season: string;
  email?: string | null;
  balance?: number;
};

export type RosterState = {
  selectedSeason: string;
  showModal: boolean;
  editingItem: Player | Coach | null;
  isCoach: boolean;
  loading: boolean;
};

export type RosterAction =
  | { type: "SET_SEASON"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "OPEN_MODAL"; isCoach?: boolean; item?: Player | Coach | null }
  | { type: "CLOSE_MODAL" };
