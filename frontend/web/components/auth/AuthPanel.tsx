import type {ReactNode} from "react";
import type {LanguageCode} from "@predrive/shared/types";
import type {AuthCopy} from "./auth-copy";
import {LanguageSelector} from "./LanguageSelector";
export function AuthPanel({children,copy,language,onLanguageChange}:{children:ReactNode;copy:AuthCopy;language:LanguageCode;onLanguageChange:(v:LanguageCode)=>void}){
 return <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10"><div className="w-full max-w-[440px]"><header className="mb-8"><a href="/" className="font-display text-3xl font-extrabold tracking-tight text-ink">preDrive</a><p className="mt-1 text-sm text-ink/65">{copy.brandDescription}</p></header><section className="rounded-xl border border-line bg-white p-6 shadow-[0_8px_30px_rgba(15,42,67,.06)] sm:p-8"><div className="mb-6 flex justify-end"><div className="w-36"><LanguageSelector value={language} onChange={onLanguageChange} copy={copy}/></div></div>{children}</section><p className="mt-6 text-center text-xs text-ink/60">preDrive · School transport safety</p></div></main>;
}
