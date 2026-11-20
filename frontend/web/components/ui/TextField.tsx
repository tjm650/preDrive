import {useId} from "react";
import type {InputHTMLAttributes} from "react";
import styles from "./text-field.module.css";
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>,"id">{label:string;hint?:string;error?:string;id?:string;}
export function TextField({label,hint,error,id,...inputProps}:Props){
 const generated=useId();const fieldId=id??generated;const hintId=hint?`${fieldId}-hint`:undefined;const errorId=error?`${fieldId}-error`:undefined;
 return <div className={styles.field}><label htmlFor={fieldId}>{label}</label><input {...inputProps} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={[hintId,errorId].filter(Boolean).join(" ")||undefined}/>{hint?<span id={hintId} className={styles.hint}>{hint}</span>:null}{error?<span id={errorId} role="alert" className={styles.error}>{error}</span>:null}</div>;
}
