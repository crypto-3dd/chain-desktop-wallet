import React, { useEffect, useRef, useState } from 'react';
import './home.less';
import 'antd/dist/antd.css';
import { Alert, Button, Checkbox, Dropdown, Form, Input, Layout, Menu, Spin } from 'antd';
import { Link, useHistory, useLocation } from 'react-router-dom';
import Icon, {
  CaretDownOutlined,
  DeleteOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  BankOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useRecoilState } from 'recoil';

import {
  sessionState,
  walletAssetState,
  walletListState,
  marketState,
  validatorListState,
  fetchingDBState,
  nftListState,
} from '../../recoil/atom';
import { ellipsis } from '../../utils/utils';
import WalletIcon from '../../assets/icon-wallet-grey.svg';
import IconHome from '../../svg/IconHome';
import IconSend from '../../svg/IconSend';
import IconReceive from '../../svg/IconReceive';
import IconStaking from '../../svg/IconStaking';
import IconNft from '../../svg/IconNft';
import IconWallet from '../../svg/IconWallet';
import ModalPopup from '../../components/ModalPopup/ModalPopup';
import SuccessModalPopup from '../../components/SuccessModalPopup/SuccessModalPopup';
import { walletService } from '../../service/WalletService';
import { Session } from '../../models/Session';
import packageJson from '../../../package.json';
import { LEDGER_WALLET_TYPE } from '../../service/LedgerService';
import { LedgerWalletMaximum } from '../../config/StaticConfig';
import { generalConfigService } from '../../storage/GeneralConfigService';

interface HomeLayoutProps {
  children?: React.ReactNode;
}

const { Sider } = Layout;

function HomeLayout(props: HomeLayoutProps) {
  const history = useHistory();
  const [confirmDeleteForm] = Form.useForm();
  const [deleteWalletAddress, setDeleteWalletAddress] = useState('');
  const [hasWallet, setHasWallet] = useState(true); // Default as true. useEffect will only re-render if result of hasWalletBeenCreated === false
  const [session, setSession] = useRecoilState(sessionState);
  const [userAsset, setUserAsset] = useRecoilState(walletAssetState);
  const [walletList, setWalletList] = useRecoilState(walletListState);
  const [marketData, setMarketData] = useRecoilState(marketState);
  const [validatorList, setValidatorList] = useRecoilState(validatorListState);
  const [nftList, setNftList] = useRecoilState(nftListState);
  const [fetchingDB, setFetchingDB] = useRecoilState(fetchingDBState);
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const [isSuccessDeleteModalVisible, setIsSuccessDeleteModalVisible] = useState(false);

  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(false);
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const didMountRef = useRef(false);

  async function fetchAndSetNewValidators(currentSession) {
    try {
      await walletService.fetchAndSaveValidators(currentSession);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Failed loading new wallet validators list', e);
    }
  }

  async function fetchAndSetNewProposals(currentSession) {
    try {
      await walletService.fetchAndSaveProposals(currentSession);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Failed loading new wallet proposals', e);
    }
  }

  async function fetchAndSetNFTs(currentSession) {
    try {
      await walletService.fetchAndSaveNFTs(currentSession);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Failed loading new wallet NFTs', e);
    }
  }

  const onWalletDeleteFinish = async () => {
    setIsButtonLoading(true);
    setFetchingDB(true);

    if (!session) {
      return;
    }
    await walletService.deleteWallet(session.wallet.identifier);

    // Switch to existing default wallet
    const allWalletsData = await walletService.retrieveAllWallets();
    setWalletList(allWalletsData);
    await walletService.setCurrentSession(new Session(allWalletsData[0]));
    const currentSession = await walletService.retrieveCurrentSession();
    const currentAsset = await walletService.retrieveDefaultWalletAsset(currentSession);
    setSession(currentSession);
    setUserAsset(currentAsset);
    await walletService.syncAll(currentSession);

    setIsButtonLoading(false);
    setIsConfirmationModalVisible(false);
    setIsSuccessDeleteModalVisible(true);
    setFetchingDB(false);
    setIsButtonDisabled(true);
    setIsConfirmDeleteVisible(false);
    confirmDeleteForm.resetFields();
  };

  const handleCancel = () => {
    if (!isButtonLoading) {
      setIsConfirmationModalVisible(false);
      setIsConfirmDeleteVisible(false);
      setIsButtonDisabled(true);
      setIsConfirmDeleteVisible(false);
      confirmDeleteForm.resetFields();
    }
  };

  const showPasswordModal = () => {
    setIsConfirmationModalVisible(false);
  };

  useEffect(() => {
    const fetchDB = async () => {
      setFetchingDB(true);
      const hasWalletBeenCreated = await walletService.hasWalletBeenCreated();
      const currentSession = await walletService.retrieveCurrentSession();
      const currentAsset = await walletService.retrieveDefaultWalletAsset(currentSession);
      const allWalletsData = await walletService.retrieveAllWallets();
      const currentMarketData = await walletService.retrieveAssetPrice(
        currentAsset.mainnetSymbol,
        'usd',
      );

      const announcementShown = await generalConfigService.checkIfHasShownAnalyticsPopup();
      setHasWallet(hasWalletBeenCreated);
      setSession(currentSession);
      setUserAsset(currentAsset);
      setWalletList(allWalletsData);
      setMarketData(currentMarketData);

      await Promise.all([
        await fetchAndSetNewValidators(currentSession),
        await fetchAndSetNewProposals(currentSession),
        await fetchAndSetNFTs(currentSession),
      ]);

      const currentValidatorList = await walletService.retrieveTopValidators(
        currentSession.wallet.config.network.chainId,
      );
      const currentNftList = await walletService.retrieveNFTs(currentSession.wallet.identifier);

      setValidatorList(currentValidatorList);
      setNftList(currentNftList);

      setFetchingDB(false);

      // Timeout for loading
      setTimeout(() => {
        setIsAnnouncementVisible(!announcementShown);
      }, 2000);
    };

    if (!didMountRef.current) {
      fetchDB();
      didMountRef.current = true;
    } else if (!hasWallet) {
      history.push('/welcome');
    }
  }, [
    history,
    hasWallet,
    session,
    setSession,
    userAsset,
    setUserAsset,
    walletList,
    setWalletList,
    marketData,
    setMarketData,
    validatorList,
    setValidatorList,
    nftList,
    setNftList,
  ]);

  const HomeMenu = () => {
    const locationPath = useLocation().pathname;
    const paths = [
      '/home',
      '/staking',
      '/send',
      '/receive',
      '/settings',
      '/governance',
      '/nft',
      '/wallet',
    ];

    let menuSelectedKey = locationPath;
    if (!paths.includes(menuSelectedKey)) {
      menuSelectedKey = '/home';
    }

    return (
      <Menu theme="dark" mode="inline" defaultSelectedKeys={[menuSelectedKey]}>
        <Menu.Item key="/home" icon={<Icon component={IconHome} />}>
          <Link to="/home">Home</Link>
        </Menu.Item>
        <Menu.Item key="/staking" icon={<Icon component={IconStaking} />}>
          <Link to="/staking">Staking</Link>
        </Menu.Item>
        <Menu.Item key="/send" icon={<Icon component={IconSend} />}>
          <Link to="/send">Send</Link>
        </Menu.Item>
        <Menu.Item key="/receive" icon={<Icon component={IconReceive} />}>
          <Link to="/receive">Receive</Link>
        </Menu.Item>
        <Menu.Item key="/governance" icon={<BankOutlined />}>
          <Link to="/governance">Governance</Link>
        </Menu.Item>
        <Menu.Item key="/nft" icon={<Icon component={IconNft} />}>
          <Link to="/nft">My NFT</Link>
        </Menu.Item>
        <Menu.Item key="/settings" icon={<SettingOutlined />}>
          <Link to="/settings">Settings</Link>
        </Menu.Item>
      </Menu>
    );
  };

  const WalletMenu = () => {
    return (
      <Menu>
        {walletList.length <= LedgerWalletMaximum ? (
          <>
            <Menu.Item className="restore-wallet-item">
              <Link to="/restore">
                <ReloadOutlined />
                Restore Wallet
              </Link>
            </Menu.Item>
            <Menu.Item className="create-wallet-item">
              <Link to="/create">
                <PlusOutlined />
                Create Wallet
              </Link>
            </Menu.Item>
          </>
        ) : (
          ''
        )}
        {walletList.length > 1 ? (
          <>
            <Menu.Item
              className="delete-wallet-item"
              onClick={() => {
                setDeleteWalletAddress(session.wallet.address);
                setIsConfirmationModalVisible(true);
              }}
            >
              <DeleteOutlined />
              Delete Wallet
            </Menu.Item>
          </>
        ) : (
          ''
        )}
        <Menu.Item>
          <Link to="/wallet">
            {/* <IconWallet /> */}
            <Icon component={IconWallet} />
            Wallet List
          </Link>
        </Menu.Item>
      </Menu>
    );
  };

  const buildVersion = packageJson.version;

  return (
    <main className="home-layout">
      <Layout>
        <Sider className="home-sider">
          <div className="logo" />
          <div className="version">SAMPLE WALLET v{buildVersion}</div>
          <HomeMenu />
          <Dropdown
            overlay={<WalletMenu />}
            placement="topCenter"
            className="wallet-selection"
            // arrow
            trigger={['click']}
          >
            <div>
              <img src={WalletIcon} alt="walletIcon" />
              {ellipsis(session?.wallet.name, 16)}
              <CaretDownOutlined />
            </div>
          </Dropdown>
        </Sider>
        <div className={`home-page ${fetchingDB ? 'loading' : ''}`}>
          <Spin spinning={fetchingDB} indicator={<LoadingOutlined style={{ fontSize: 96 }} />}>
            <div className="container">{props.children}</div>
          </Spin>
        </div>
        <ModalPopup
          isModalVisible={isConfirmationModalVisible}
          handleCancel={handleCancel}
          handleOk={showPasswordModal}
          confirmationLoading={isButtonLoading}
          closable={!isButtonLoading}
          okText="Confirm"
          footer={[
            <Button
              key="submit"
              type="primary"
              loading={isButtonLoading}
              onClick={() => setIsConfirmDeleteVisible(true)}
              disabled={isButtonDisabled}
              hidden={isConfirmDeleteVisible}
              danger
            >
              Confirm
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={isButtonLoading}
              onClick={confirmDeleteForm.submit}
              disabled={isButtonDisabled}
              hidden={!isConfirmDeleteVisible}
              danger
            >
              Delete Wallet
            </Button>,
            <Button key="back" type="link" onClick={handleCancel} disabled={isButtonLoading}>
              Cancel
            </Button>,
          ]}
        >
          <>
            <div className="title">Confirm Wallet Deletion</div>
            <div className="description">Please review the below information. </div>
            <div className="item">
              <div className="label">Delete Wallet Address</div>
              {/* <div className="address">{`${session.wallet.address}`}</div> */}
              <div className="address">{`${deleteWalletAddress}`}</div>
            </div>
            {!isConfirmDeleteVisible ? (
              <>
                <div className="item">
                  <Alert
                    type="warning"
                    message={`Are you sure you want to delete the wallet? ${
                      session.wallet.walletType !== LEDGER_WALLET_TYPE
                        ? 'If you have not backed up your wallet mnemonic phrase, this will result in losing your funds forever.'
                        : ''
                    }`}
                    showIcon
                  />
                </div>
                <div className="item">
                  <Checkbox
                    checked={!isButtonDisabled}
                    onChange={() => setIsButtonDisabled(!isButtonDisabled)}
                  >
                    {session.wallet.walletType !== LEDGER_WALLET_TYPE
                      ? 'I understand that the only way to regain access is by restoring wallet mnemonic phrase.'
                      : 'I understand that the only way to regain access is by using the same ledger device with the correct address index'}
                  </Checkbox>
                </div>
              </>
            ) : (
              <div className="item">
                <Form
                  layout="vertical"
                  form={confirmDeleteForm}
                  name="control-hooks"
                  requiredMark="optional"
                  onFinish={onWalletDeleteFinish}
                >
                  <Form.Item
                    name="delete"
                    label="Please enter DELETE"
                    hasFeedback
                    rules={[
                      {
                        required: true,
                      },
                      {
                        pattern: /^DELETE$/,
                        message: 'Please enter DELETE',
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                </Form>
              </div>
            )}
          </>
        </ModalPopup>
        <SuccessModalPopup
          isModalVisible={isSuccessDeleteModalVisible}
          handleCancel={() => {
            setIsSuccessDeleteModalVisible(false);
          }}
          handleOk={() => {
            setIsSuccessDeleteModalVisible(false);
          }}
          title="Success!"
          button={null}
          footer={[
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                setIsSuccessDeleteModalVisible(false);
              }}
            >
              Ok
            </Button>,
          ]}
        >
          <>
            <div className="description">
              Wallet Address
              <br />
              {deleteWalletAddress}
              <br />
              has been deleted.
            </div>
          </>
        </SuccessModalPopup>
        <ModalPopup
          isModalVisible={isAnnouncementVisible}
          handleCancel={() => {
            setIsAnnouncementVisible(false);
            generalConfigService.setHasShownAnalyticsPopup(true);
          }}
          handleOk={() => {}}
          footer={[]}
        >
          <>
            <div className="title">Data analytics was added</div>
            <div className="description">
              You can help improve Crypto.org Chain Wallet by having Data Analytics enabled. The
              data collected will help the development team prioritize new features and improve
              existing functionalities. <br />
              <br />
              You can always come back to disable Data Analytics anytime under General Configuration
              in{' '}
              <Link
                to="/settings"
                onClick={async () => {
                  setIsAnnouncementVisible(false);
                  await generalConfigService.setHasShownAnalyticsPopup(true);
                }}
              >
                Settings
              </Link>
              .
            </div>
          </>
        </ModalPopup>
      </Layout>
    </main>
  );
}

export default HomeLayout;
