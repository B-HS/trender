import { VendorSidebar } from '@widgets/vendor/vendor-sidebar'
import { FC, PropsWithChildren } from 'react'

const VendorLayout: FC<PropsWithChildren> = ({ children }) => (
    <div className='flex flex-col lg:flex-row gap-4 py-2'>
        <VendorSidebar />
        <div className='flex-1 min-w-0'>{children}</div>
    </div>
)

export default VendorLayout
