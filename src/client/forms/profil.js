import Yup from 'yup';
import { InputField } from '../fields';
import { getDefaultValues, getOneValidationSchema, getOneField } from './utils';
const fields = {
  lookingFor: {
    label: 'Je recherche',
    component: InputField,
    validate: Yup.string(),
    required: true,
  },
  bio: {
    label: 'Ma bio',
    component: InputField,
    validate: Yup.string(),
    required: true,
  },
  lookingFor: {
    label: 'Je recherche',
    component: InputField,
    validate: Yup.string(),
    required: true,
  },
  interest: {
    label: 'Interêts',
    component: InputField,
    validate: Yup.string(),
    required: true,
  },
  pictures: {
    label: 'Mes photos',
    component: InputField,
    validate: Yup.string(),
    required: true,
  },
};

export const defaultValues = getDefaultValues(fields);
export const getField = getOneField(fields);
export const getValidationSchema = extend =>
  Yup.object().shape(getOneValidationSchema(fields, extend));