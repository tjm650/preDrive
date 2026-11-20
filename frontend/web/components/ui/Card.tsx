import type {HTMLAttributes,ReactNode} from "react";
import styles from "./card.module.css";
export function Card({children,className,...props}:{children:ReactNode;className?:string}&HTMLAttributes<HTMLDivElement>){return <div {...props} className={[styles.card,className??""].join(" ")}>{children}</div>;}
