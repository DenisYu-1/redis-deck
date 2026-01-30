import LogoSvg from '@/assets/logo.svg?react';
import { SvgIcon } from './SvgIcon';

export function Logo() {
    return <SvgIcon component={LogoSvg} inheritViewBox className="logo" />;
}
