'use client';

import { Schema } from 'yup';
import { FC } from 'react';

const FormField: FC<{field: Schema}> = ({field}) => {
    return <div>
        {field.type}
    </div>;
}

export default FormField;