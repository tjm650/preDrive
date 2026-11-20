import type {ButtonHTMLAttributes,ReactNode} from "react";
import styles from "./button.module.css";
type Variant="primary"|"secondary"|"outline"|"danger"|"ghost";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>{variant?:Variant;loading?:boolean;fullWidth?:boolean;leading?:ReactNode;}
export function Button({variant="primary",loading=false,fullWidth=false,leading,children,disabled,className,...props}:ButtonProps){
 return <button {...props} disabled={disabled||loading} aria-busy={loading||undefined} className={[styles.button,styles[variant],fullWidth?styles.fullWidth:"",className??""].join(" ")}>
 {loading?<span className={styles.spinner} aria-hidden="true"/>:leading?<span className={styles.leading}>{leading}</span>:null}<span>{children}</span></button>;
}
