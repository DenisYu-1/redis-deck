import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

/** A Key name that opens the Key on the Keys page. */
export function KeyLink({ name }: { name: string }) {
    const navigate = useNavigate();
    const open = () => {
        useAppStore.getState().setSelectedKey(name);
        void navigate('/keys');
    };
    return (
        <button type="button" className="klink" onClick={open}>
            {name}
        </button>
    );
}
