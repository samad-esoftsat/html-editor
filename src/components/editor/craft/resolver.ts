import { Button } from './Button';
import { Column } from './Column';
import { Divider } from './Divider';
import { Heading } from './Heading';
import { Image } from './Image';
import { List } from './List';
import { Page } from './Page';
import { Row } from './Row';
import { Section } from './Section';
import { Spacer } from './Spacer';
import { Text } from './Text';

export const RESOLVERS = {
  Button,
  Column,
  Divider,
  Heading,
  Image,
  List,
  Page,
  Row,
  Section,
  Spacer,
  Text,
} as const;

export type ResolvedName = keyof typeof RESOLVERS;
