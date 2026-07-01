import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({
    mustVerifyEmail,
    status,
}: PageProps<{ mustVerifyEmail: boolean; status?: string }>) {
    return (
        <AuthenticatedLayout
            header={
                <h2>
                    Perfil
                </h2>
            }
        >
            <Head title="Perfil" />

            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <div className="flex flex-col gap-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.82fr)]">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="min-w-0"
                        />

                        <UpdatePasswordForm className="min-w-0" />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
