export const colors = {
  ink:"#0F2A43",busYellow:"#F5B301",canvas:"#F6F4EE",surface:"#FFFFFF",
  line:"#E5E1D6",success:"#1E9E6A",danger:"#D64545",warning:"#E08A00",info:"#2563A8"
} as const;
export type PreDriveColor = keyof typeof colors;
