import styles from "./feedback-state.module.css";
export function FeedbackState({title,description,kind="empty",onRetry}:{title:string;description?:string;kind?:"loading"|"empty"|"error";onRetry?:()=>void}){
 return <section className={styles.state} aria-live="polite">{kind==="loading"?<span className={styles.loader} aria-hidden="true"/>:null}<h2>{title}</h2>{description?<p>{description}</p>:null}{kind==="error"&&onRetry?<button type="button" onClick={onRetry}>Try again</button>:null}</section>;
}
